/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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
 * The Original Code is XForms code.
 *
 * The Initial Developer of the Original Code is
 * Novell, Inc.
 * Portions created by the Initial Developer are Copyright (C) 2005
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *  Allan Beaufour <abeaufour@novell.com>
 *  Merle Sterling <msterlin@us.ibm.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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

#include "nsIDOMAttr.h"
#include "nsIDOMEvent.h"
#include "nsIDOMNode.h"
#include "nsIDOMElement.h"
#include "nsIDOMDocument.h"
#include "nsIDOMNodeList.h"
#include "nsIDOMNamedNodeMap.h"
#include "nsIXFormsRepeatElement.h"
#include "nsIXFormsControl.h"

#include "nsString.h"

#include "nsIInstanceElementPrivate.h"
#include "nsXFormsActionModuleBase.h"
#include "nsXFormsActionElement.h"
#include "nsXFormsUtils.h"
#include "nsIDOM3Node.h"

#include "math.h"

#ifdef DEBUG
//#define DEBUG_XF_INSERTDELETE
#endif

/**
 * Implementation of the XForms \<insert\> and \<delete\> elements.
 *
 * @see http://www.w3.org/TR/xforms/slice9.html#action-insert
 *
 * @todo The spec. states that the events must set their Context Info to:
 * "Path expression used for insert/delete (xsd:string)" (XXX)
 * @see http://www.w3.org/TR/xforms/slice4.html#evt-insert
 * @see https://bugzilla.mozilla.org/show_bug.cgi?id=280423
 *
 */
class nsXFormsInsertDeleteElement : public nsXFormsActionModuleBase
{
private:
  PRBool mIsInsert;

  enum Location {
    eLocation_After,
    eLocation_Before,
    eLocation_FirstChild
  };

  /** Get the first node of a given type in aNodes.
   *
   *  @param aNodes        array of nodes
   *  @param aNodeType     type of node to find
   *
   *  @return aResult      node of type aNodeType
   */
  nsresult GetFirstNodeOfType(nsCOMArray<nsIDOMNode> *aNodes,
                              PRUint16 aNodeType,
                              nsIDOMNode **aResult);

  /** Insert a node.
   *
   *  @param aTargetNode     target location node
   *  @param aNewNode        node to insert
   *  @param aLocation       insert location relative to target
   *
   *  @return aResult        result node
   */
  nsresult InsertNode(nsIDOMNode *aTargetNode, nsIDOMNode *aNewNode,
                      Location aLocation, nsIDOMNode **aResNode);

  nsresult RefreshRepeats(nsCOMArray<nsIDOMNode> *aNodes);

public:
  NS_DECL_NSIXFORMSACTIONMODULEELEMENT

  /** Constructor */
  nsXFormsInsertDeleteElement(PRBool aIsInsert) :
    mIsInsert(aIsInsert)
    {}
};

NS_IMETHODIMP
nsXFormsInsertDeleteElement::HandleAction(nsIDOMEvent            *aEvent,
                                          nsIXFormsActionElement *aParentAction)
{
  if (!mElement)
    return NS_OK;

  nsresult rv;
  nsCOMPtr<nsIModelElementPrivate> model;
  PRBool usesModelBinding;

  //
  // Step 1 (Insert or Delete): Determine the insert/delete context.
  //
  // If the bind attribute is present, it is evaluated to determine the
  // in-scope evaluation context and the context attribute is ignored;
  // otherwise, the context attribute is evaluated and overrides the
  // in-scope evaluation context.
  //
  // A NodeSet binding attribute (@bind or @nodeset) is required unless
  // the context attribute is present.
  //
  nsCOMPtr<nsIDOMXPathResult> contextNodeset;
  nsCOMPtr<nsIDOMNode> contextNode;
  PRUint32 contextNodesetSize = 0;

  nsAutoString bindExpr;
  nsAutoString contextExpr;
  nsAutoString contextStr;

  // Determine if the context node is specified via @bind or @context.
  // If @bind is present, @context is ignored.
  mElement->GetAttribute(NS_LITERAL_STRING("bind"), bindExpr);
  if (!bindExpr.IsEmpty()) {
    contextStr.AssignLiteral("bind");
  } else {
    mElement->GetAttribute(NS_LITERAL_STRING("context"), contextExpr);
    if (!contextExpr.IsEmpty()) {
      contextStr.AssignLiteral("context");
    }
  }

  if (!contextStr.IsEmpty()) {
    // Context node is specified via either @bind or @context.
    rv = nsXFormsUtils::EvaluateNodeBinding(mElement,
                                            nsXFormsUtils::ELEMENT_WITH_MODEL_ATTR,
                                            contextStr,
                                            EmptyString(),
                                            nsIDOMXPathResult::ORDERED_NODE_SNAPSHOT_TYPE,
                                            getter_AddRefs(model),
                                            getter_AddRefs(contextNodeset),
                                            &usesModelBinding);
    NS_ENSURE_SUCCESS(rv, rv);

    if (!model)
      return NS_OK;
    
    // The insert/delete action is terminated with no effect if the context
    // is the empty node-set.
    if (contextNodeset) {
      rv = contextNodeset->GetSnapshotLength(&contextNodesetSize);
      NS_ENSURE_SUCCESS(rv, rv);

      if (contextNodesetSize < 1)
        return NS_OK;

      // Context node is the first node in the nodeset.
      contextNodeset->SnapshotItem(0, getter_AddRefs(contextNode));
    }

  } else {
    // Neither @bind nor @context. Get the in-scope evaluation context.
    nsCOMPtr<nsIDOMElement> bindElement;
    nsCOMPtr<nsIXFormsControl> parentControl;
    PRBool outerBind;
    rv = nsXFormsUtils::GetNodeContext(mElement,
                                       nsXFormsUtils::ELEMENT_WITH_MODEL_ATTR,
                                       getter_AddRefs(model),
                                       getter_AddRefs(bindElement),
                                       &outerBind,
                                       getter_AddRefs(parentControl),
                                       getter_AddRefs(contextNode));

    NS_ENSURE_SUCCESS(rv, rv);

    // The insert/delete action is terminated with no effect if the context
    // is the empty node-set.
    if (!model || !contextNode)
      return NS_OK;
  }

  // The insert action is terminated with no effect if the context attribute
  // is given and the insert context does not evaluate to an element node.
  if (mIsInsert && !contextExpr.IsEmpty()) {
    PRUint16 nodeType;
    contextNode->GetNodeType(&nodeType);
    if (nodeType != nsIDOMNode::ELEMENT_NODE)
      return NS_OK;
  }

  //
  // Step 2 (Insert or Delete): Determine the node-set binding.
  //
  // If the bind attribute is present, it directly determines the Node Set
  // Binding node-set. If a nodeset attribute is present, it is evaluated
  // within the context to determine the Node Set Binding node-set.
  //
  nsCOMPtr<nsIDOMXPathResult> nodeset;
  PRUint32 nodesetSize = 0;

  if (bindExpr.IsEmpty()) {
    nsAutoString nodesetExpr;
    mElement->GetAttribute(NS_LITERAL_STRING("nodeset"), nodesetExpr);
    if (!nodesetExpr.IsEmpty()) {
      // Evaluate the nodeset attribute within the context.
      rv = nsXFormsUtils::EvaluateXPath(nodesetExpr, contextNode, mElement,
                                        nsIDOMXPathResult::ORDERED_NODE_SNAPSHOT_TYPE,
                                        getter_AddRefs(nodeset));
      NS_ENSURE_SUCCESS(rv, rv);

      rv = nodeset->GetSnapshotLength(&nodesetSize);
      NS_ENSURE_SUCCESS(rv, rv);
    }

    // The insert action is terminated with no effect if the context attribute
    // is not given and the Node Set Binding node-set is the empty node-set.
    //
    // The delete action is terminated with no effect if the Node Set Binding
    // node-set is the empty node-set.
    if (!nodeset || nodesetSize < 1) {
      if (!mIsInsert || (mIsInsert && contextExpr.IsEmpty()))
        return NS_OK;
    }
  } else {
    // Nodeset was determined by @bind.
    nodeset = contextNodeset;
    nodesetSize = contextNodesetSize;
  }

  //
  // Step 3 (Insert): Determine the origin node-set.
  //
  nsCOMPtr<nsIDOMXPathResult> originNodeset;
  nsCOMPtr<nsIDOMXPathResult> originNode;
  PRUint32 originNodesetSize = 0;

  if (mIsInsert) {
    // If the origin attribute is not given and the Node Set Binding node-set
    // is empty, then the origin node-set is the empty node-set. Otherwise,
    // if the origin attribute is not given, then the origin node-set consists
    // of the last node of the Node Set Binding node-set (which we will obtain
    // just before performing the insert).
    //
    // If the origin attribute is given, the origin node-set is the result of
    // the evaluation of the origin attribute in the insert context.
    nsAutoString origin;
    mElement->GetAttribute(NS_LITERAL_STRING("origin"), origin);

    if (!origin.IsEmpty()) {
      rv = nsXFormsUtils::EvaluateXPath(origin, contextNode, mElement,
                                        nsIDOMXPathResult::ORDERED_NODE_SNAPSHOT_TYPE,
                                        getter_AddRefs(originNodeset));
      NS_ENSURE_SUCCESS(rv, rv);

      // The insert action is terminated with no effect if the origin node-set
      // is the empty node-set.
      if (!originNodeset)
        return NS_OK;

      rv = originNodeset->GetSnapshotLength(&originNodesetSize);
      NS_ENSURE_SUCCESS(rv, rv);

      // The insert action is terminated with no effect if the origin node-set
      // is the empty node-set.
      if (originNodesetSize < 1)
        return NS_OK;
    }
  }

  //
  // Step 4 (Insert), Step 3 (Delete):
  // Determine the insert/delete location node.
  //
  // Insert: If the Node Set Binding node-set is not specified or empty, the
  // insert location node is the insert context node. Otherwise, if the at
  // attribute is not given, then the insert location node is the last node
  // of the Node Set Binding node-set. Otherwise, an insert location node is
  // determined from the at attribute.
  //
  // Delete: If the at attribute is not specified, there is no delete location.
  // Otherwise, the delete location is determined by evaluating the XPath
  // expression specified by the at attribute.
  //

  nsCOMPtr<nsIDOMNode> locationNode;
  PRUint32 atInt = 0;
  double atDoub = 0;

  nsAutoString atExpr;
  mElement->GetAttribute(NS_LITERAL_STRING("at"), atExpr);
        
  if (mIsInsert) {
    if (!nodeset || nodesetSize < 1) {
       // The insert location node is the insert context node.
       locationNode = contextNode;
    } else if (atExpr.IsEmpty()) {
      // The insert location node is the last node of the Node Set Binding
      // node-set.
      nodeset->SnapshotItem(nodesetSize - 1, getter_AddRefs(locationNode));
      NS_ENSURE_STATE(locationNode);
    }
  }

  if (!locationNode) {
    // For insert, we have a nodeset and got past the special cases of an empty
    // nodeset or no @at expression so the insert location node is determined by
    // @at.
    //
    // For delete, the delete location is determined by the @at expression if
    // present; otherwise there is no delete location and each node in the
    // Node Set Binding node-set is deleted, unless the node is the root
    // document element of an instance.
    if (!atExpr.IsEmpty()) {
      // The evaluation context node is the first node in document order of
      // the Node Set Binding node-set.
      nsCOMPtr<nsIDOMNode> evalContextNode;
      nodeset->SnapshotItem(0, getter_AddRefs(evalContextNode));

      // The context size is the size of the Node Set Binding node-set and
      // the context position is 1.
      nsCOMPtr<nsIDOMXPathResult> xpRes;
      rv = nsXFormsUtils::EvaluateXPath(atExpr, evalContextNode, mElement,
                                        nsIDOMXPathResult::NUMBER_TYPE,
                                        getter_AddRefs(xpRes), 1, nodesetSize);

      if (xpRes) {
        rv = xpRes->GetNumberValue(&atDoub);
        NS_ENSURE_SUCCESS(rv, rv);
      }

      // Determine the insert/delete location.
      if (atDoub < 1) {
        atInt = 1;
      } else {
        // If the location is greater than the nodeset size or NaN,
        // the location is the end of the nodeset.
        // XXX: Need to check for NaN but isnan() is not portable.
        atInt = (PRInt32) floor(atDoub+0.5);
        if (atInt > nodesetSize)
          atInt = nodesetSize;
      }

      // The location node is the node in the Node Set Binding node-set at
      // the position given by the location.
      nodeset->SnapshotItem(atInt - 1, getter_AddRefs(locationNode));
      NS_ENSURE_STATE(locationNode);
    }
  }

  //
  // Step 5 (Insert): Each node in the origin node-set is cloned in the
  // order it appears in the origin node-set. If the origin node-set is empty
  // (Step 3), the origin node-set consists of the last node of the Node Set
  // Binding node-set.
  //
  // The clones are deep copies of the original nodes except the contents of
  // nodes of type xsd:ID are modified to remain as unique values in the
  // instance data after the clones are inserted.
  //
  // XXX: Need to modify the contents of nodes of type xsd:ID to remain
  // unique.

  nsCOMArray<nsIDOMNode> cloneNodes;
  nsCOMPtr<nsIDOMXPathResult> cloneNodeset;
  PRUint32 cloneNodesetSize = 0;

  if (mIsInsert) {
    nsCOMPtr<nsIDOMNode> prototypeNode, newNode;
    PRUint32 cloneIndex;
    
    // Get prototype node(s) and clone.
    if (originNodesetSize < 1) {
      // Origin nodeset is empty. Clone the last node of nodeset.
      cloneNodeset = nodeset;
      cloneNodesetSize = nodesetSize;
      cloneIndex = nodesetSize - 1;
    } else {
      // Clone all the nodes in the origin node-set.
      cloneNodeset = originNodeset;
      cloneNodesetSize = originNodesetSize;
      cloneIndex = 0;
    }

    cloneNodeset->SnapshotItem(cloneIndex, getter_AddRefs(prototypeNode));
    NS_ENSURE_STATE(prototypeNode);

    // The prototypeNode (node to be cloned) and the locationNode (node to
    // which the clone will be inserted) may belong to different instances.
    nsCOMPtr<nsIDOMDocument> originDoc, locationDoc;
    prototypeNode->GetOwnerDocument(getter_AddRefs(originDoc));
    NS_ENSURE_STATE(originDoc);
    locationNode->GetOwnerDocument(getter_AddRefs(locationDoc));
    NS_ENSURE_STATE(locationDoc);

    while ((cloneIndex < cloneNodesetSize) && prototypeNode) {
      if (!SameCOMIdentity(originDoc, locationDoc)) {
        locationDoc->ImportNode(prototypeNode, PR_TRUE, getter_AddRefs(newNode));
      } else {
        prototypeNode->CloneNode(PR_TRUE, getter_AddRefs(newNode));
      }
      NS_ENSURE_STATE(newNode);
      cloneNodes.AppendObject(newNode);

      // Get the next node in the node-set.
      ++cloneIndex;
      cloneNodeset->SnapshotItem(cloneIndex, getter_AddRefs(prototypeNode));
    }
  }

  //
  // Step 6 and 7 (Insert): Determine the target location (Steps 6a-d) and
  // insert all of the nodes that were cloned in Step 5.
  //
  // Step 4 (Delete): Delete the nodes.
  //
  
  nsCOMPtr<nsIDOMDocument> locationDoc;
  nsCOMPtr<nsIDOMElement> locationDocElement;
  nsCOMPtr<nsIDOMNode> parentNode, newNode, resNode, instNode;
  if (mIsInsert) {
    // The cloned node or nodes are inserted in the order they were cloned at
    // their target location depending on their node type.
    nsCOMPtr<nsIDOMNode> newNode;
    
    for (PRInt32 i = 0; i < cloneNodes.Count(); ++i) {
      // Node to be inserted.
      newNode = cloneNodes[i];

      // Get the node type of the insert node and location node.
      PRUint16 newNodeType, locationNodeType;
      newNode->GetNodeType(&newNodeType);
      locationNode->GetNodeType(&locationNodeType);

      // Step 6a - If the Node Set Binding node-set is not specified or empty
      // OR Step 6b - If the Node Set Binding node-set is specified and not
      // empty and the type of the cloned node is different from the type of
      // the insert location node, the target location depends on the node
      // type of the cloned node.
      //
      // If the cloned node is an attribute, then the target location is before
      // the first attribute of the insert location node. If the cloned node is
      // not an attribute, then the target location is before the first child
      // of the insert location node.
      if ((!nodeset || nodesetSize < 1) ||
          (nodeset && nodesetSize > 1 && newNodeType != locationNodeType)) {
        Location location = eLocation_Before;
        if (newNodeType != nsIDOMNode::ATTRIBUTE_NODE) {
          // Target location is before the first child of location node. If the
          // location node is empty (has no children), it remains the location
          // node and the new node will become the first child of the location
          // node.
          nsCOMPtr<nsIDOMNode> targetNode;
          locationNode->GetFirstChild(getter_AddRefs(targetNode));
          if (targetNode) {
            locationNode.swap(targetNode);
          } else {
            // New node will become first child of locationNode.
            location = eLocation_FirstChild;
          }
        }
        InsertNode(locationNode, newNode, location, getter_AddRefs(resNode));
      } else {
          // Step 6c - If insert location node is the root element of an
          // instance, then that instance root element location is the target
          // location and the cloned node replaces the instance element. If
          // there is more than one cloned node to insert, only the first node
          // that does not cause a conflict is considered.
          //
          locationNode->GetOwnerDocument(getter_AddRefs(locationDoc));
          NS_ENSURE_STATE(locationDoc);
          locationDoc->GetDocumentElement(getter_AddRefs(locationDocElement));

          if (SameCOMIdentity(locationNode, locationDocElement)) {
            // Step 7 - Replace the instance element with the first element
            // node of the cloned node(s).
            nsCOMPtr<nsIDOMNode> insertNode;
            GetFirstNodeOfType(&cloneNodes, nsIDOMNode::ELEMENT_NODE,
                               getter_AddRefs(insertNode));
            if (insertNode) {
              nsCOMPtr<nsIDOMNode> child;
              locationDoc->RemoveChild(locationNode, getter_AddRefs(child));
              locationDoc->AppendChild(insertNode, getter_AddRefs(resNode));
              // Done...because we only consider the first node that does
              // not cause a conflict.
              break;
            }
          } else {
            // Step 6d - the target location is immediately before or after the
            // insert location node, based on the position attribute setting or
            // its default.
            PRBool insertAfter = PR_TRUE;
            nsAutoString position;
            mElement->GetAttribute(NS_LITERAL_STRING("position"), position);
            if (!position.IsEmpty()) {
              if (position.EqualsLiteral("before")) {
                insertAfter = PR_FALSE;
              } else if (!position.EqualsLiteral("after")) {
                // This is not a valid document...
                return NS_ERROR_FAILURE;
              }
            }
            InsertNode(locationNode, newNode,
                       insertAfter ? eLocation_After: eLocation_Before,
                       getter_AddRefs(resNode));
          }
        }
      }
      rv = nsXFormsUtils::GetInstanceNodeForData(resNode, getter_AddRefs(instNode));
      NS_ENSURE_SUCCESS(rv, rv);

    // Step 8: Set indexes for repeats
    rv = RefreshRepeats(&cloneNodes);
    NS_ENSURE_SUCCESS(rv, rv);

  } else {
    // Delete
    // If there is no delete location, each node in the Node Set Binding
    // node-set is deleted, unless the node is the root document element of an
    // instance.
    //
    // If there is a delete location, the node at the delete location in the
    // Node Set Binding node-set is deleted, unless the node is the root
    // document element of an instance.
    PRBool didDelete = PR_FALSE;

    PRUint32 deleteIndex, deleteCount;

    if (!locationNode) {
      // Delete all the nodes in the node-set.
      deleteIndex = 0;
      deleteCount = nodesetSize;
    } else {
      // Delete the node at the delete location.
      deleteIndex = atInt - 1;
      deleteCount = atInt;
    }

    nodeset->SnapshotItem(deleteIndex, getter_AddRefs(locationNode));
    NS_ENSURE_STATE(locationNode);

    locationNode->GetOwnerDocument(getter_AddRefs(locationDoc));
    NS_ENSURE_STATE(locationDoc);

    rv = nsXFormsUtils::GetInstanceNodeForData(locationNode, getter_AddRefs(instNode));
    NS_ENSURE_SUCCESS(rv, rv);

    locationDoc->GetDocumentElement(getter_AddRefs(locationDocElement));
    while ((deleteIndex < deleteCount) && locationNode) {
      // Delete the node(s) unless the delete location is the root document
      // element of an instance.
      PRUint16 locationNodeType;
      locationNode->GetNodeType(&locationNodeType);
      if (locationNodeType == nsIDOMNode::ATTRIBUTE_NODE) {
        nsCOMPtr<nsIDOMElement> ownerElement;
        nsCOMPtr<nsIDOMAttr> attrNode(do_QueryInterface(locationNode));
        attrNode->GetOwnerElement(getter_AddRefs(ownerElement));
        NS_ENSURE_STATE(ownerElement);

        nsCOMPtr<nsIDOMAttr> resAttr;
        ownerElement->RemoveAttributeNode(attrNode, getter_AddRefs(resAttr));
        resNode = locationNode;

        // Deleted at least one node so delete will not terminate.
        didDelete = PR_TRUE;
      } else {
        if (!SameCOMIdentity(locationNode, locationDocElement)) {
          locationNode->GetParentNode(getter_AddRefs(parentNode));
          NS_ENSURE_STATE(parentNode);

          rv = parentNode->RemoveChild(locationNode, getter_AddRefs(resNode));
          NS_ENSURE_SUCCESS(rv, rv);

          // Deleted at least one node so delete will not terminate.
          didDelete = PR_TRUE;
        }
      }
      // Get the next node in the node-set.
      ++deleteIndex;
      nodeset->SnapshotItem(deleteIndex, getter_AddRefs(locationNode));
    }

    // The delete action is terminated with no effect if no node is deleted.
    if (!didDelete)
      return NS_OK;
  }
  NS_ENSURE_STATE(resNode);

  // Dispatch xforms-insert/delete event to the instance node we have modified
  // data for
  rv = nsXFormsUtils::DispatchEvent(instNode,
                                    mIsInsert ? eEvent_Insert : eEvent_Delete);
  NS_ENSURE_SUCCESS(rv, rv);

  // Dispatch refreshing events to the model
  if (aParentAction) {
    aParentAction->SetRebuild(model, PR_TRUE);
    aParentAction->SetRecalculate(model, PR_TRUE);
    aParentAction->SetRevalidate(model, PR_TRUE);
    aParentAction->SetRefresh(model, PR_TRUE);
  } else {
    rv = model->RequestRebuild();
    NS_ENSURE_SUCCESS(rv, rv);
    rv = model->RequestRecalculate();
    NS_ENSURE_SUCCESS(rv, rv);
    rv = model->RequestRevalidate();
    NS_ENSURE_SUCCESS(rv, rv);
    rv = model->RequestRefresh();
    NS_ENSURE_SUCCESS(rv, rv);
  }

  return NS_OK;
}


nsresult
nsXFormsInsertDeleteElement::GetFirstNodeOfType(nsCOMArray<nsIDOMNode> *aNodes,
                                                PRUint16 aNodeType,
                                                nsIDOMNode **aResult)
{
  nsCOMPtr<nsIDOMNode> currentNode;

  for (PRInt32 i = 0; i < aNodes->Count(); ++i) {
    currentNode = aNodes->ObjectAt(i);
    PRUint16 nodeType;
    currentNode->GetNodeType(&nodeType);
    if (nodeType == aNodeType) {
      NS_IF_ADDREF(*aResult = currentNode);
      break;
    }
  }

  return NS_OK;
}

nsresult
nsXFormsInsertDeleteElement::InsertNode(nsIDOMNode *aTargetNode,
                                        nsIDOMNode *aNewNode,
                                        Location   aLocation,
                                        nsIDOMNode **aResNode)
{
  NS_ENSURE_ARG(aTargetNode);
  NS_ENSURE_ARG(aNewNode);
  NS_ENSURE_ARG_POINTER(aResNode);

  // Make sure the result node is null in case we encounter a condition
  // where the node cannot be inserted and is skipped.
  *aResNode = nsnull;

  // Step 7 - The new node is inserted at the target location depending on its
  // node type. If the cloned node is a duplicate of another attribute in its
  // parent element, then the duplicate attribute is first removed. If a cloned
  // node cannot be placed at the target location due to a node type conflict,
  // then the insertion for that particular clone node is ignored.
  nsCOMPtr<nsIDOMNode> resNode;
  
  PRUint16 targetNodeType, newNodeType;
  aTargetNode->GetNodeType(&targetNodeType);
  aNewNode->GetNodeType(&newNodeType);
  
  if (newNodeType == nsIDOMNode::ATTRIBUTE_NODE) {
    // Can add an attribute to an element node or the owning element
    // of an attribute node.
    nsCOMPtr<nsIDOMElement> ownerElement;

    if (targetNodeType == nsIDOMNode::ELEMENT_NODE) {
      ownerElement = do_QueryInterface(aTargetNode);
    } else if (targetNodeType == nsIDOMNode::ATTRIBUTE_NODE) {
      nsCOMPtr<nsIDOMAttr> targetAttrNode(do_QueryInterface(aTargetNode));
      targetAttrNode->GetOwnerElement(getter_AddRefs(ownerElement));
    }
    NS_ENSURE_STATE(ownerElement);

    // Check for a duplicate attribute.
    nsCOMPtr<nsIDOMAttr> attrNode(do_QueryInterface(aNewNode));
    nsAutoString attrName, attrValue;
    attrNode->GetName(attrName);
    attrNode->GetValue(attrValue);

    PRBool hasAttribute = PR_FALSE;
    ownerElement->HasAttribute(attrName, &hasAttribute);
    if (hasAttribute) {
      ownerElement->RemoveAttribute(attrName);
    }
    ownerElement->SetAttribute(attrName, attrValue);
    resNode = aTargetNode;
    resNode.swap(*aResNode);

  } else {
    // New node will be inserted at location aLocation.
    nsCOMPtr<nsIDOMNode> targetNode = aTargetNode;

    nsCOMPtr<nsIDOMNode> parentNode;
    targetNode->GetParentNode(getter_AddRefs(parentNode));
    NS_ENSURE_STATE(parentNode);

    if (aLocation == eLocation_FirstChild) {
      aTargetNode->AppendChild(aNewNode, getter_AddRefs(resNode));
      resNode.swap(*aResNode);
    } else {
      if (aLocation == eLocation_After) {
        // If we're at the end of the nodeset, this returns nsnull, which is
        // fine, because InsertBefore then inserts at the end of the nodeset.
        aTargetNode->GetNextSibling(getter_AddRefs(targetNode));
      }
      parentNode->InsertBefore(aNewNode, targetNode,
                               getter_AddRefs(resNode));
      resNode.swap(*aResNode);
    }
  }
  
  return NS_OK;
}

nsresult
nsXFormsInsertDeleteElement::RefreshRepeats(nsCOMArray<nsIDOMNode> *aNodes)
{
  // XXXbeaufour: only check repeats belonging to the same model...
  // possibly use mFormControls? Should be quicker than searching through
  // entire document!! mModel->GetControls("repeat"); Would also possibly
  // save a QI?

  nsCOMPtr<nsIDOMDocument> document;

  nsresult rv = mElement->GetOwnerDocument(getter_AddRefs(document));
  NS_ENSURE_STATE(document);

  nsCOMPtr<nsIDOMNodeList> repeatNodes;
  document->GetElementsByTagNameNS(NS_LITERAL_STRING(NS_NAMESPACE_XFORMS),
                                   NS_LITERAL_STRING("repeat"),
                                   getter_AddRefs(repeatNodes));
  NS_ENSURE_STATE(repeatNodes);

  // work over each node and if the node contains the inserted element
  PRUint32 nodeCount;
  rv = repeatNodes->GetLength(&nodeCount);
  NS_ENSURE_SUCCESS(rv, rv);

  for (PRUint32 node = 0; node < nodeCount; ++node) {
    nsCOMPtr<nsIDOMNode> repeatNode;

    rv = repeatNodes->Item(node, getter_AddRefs(repeatNode));
    nsCOMPtr<nsIXFormsRepeatElement> repeatEl(do_QueryInterface(repeatNode));
    NS_ENSURE_STATE(repeatEl);

    for (PRInt32 i = 0; i < aNodes->Count(); ++i) {
      nsCOMPtr<nsIDOMNode> newNode = aNodes->ObjectAt(i);
      rv = repeatEl->HandleNodeInsert(newNode);
      NS_ENSURE_SUCCESS(rv, rv);
    }
  }

  return NS_OK;
}
 

NS_HIDDEN_(nsresult)
NS_NewXFormsInsertElement(nsIXTFElement **aResult)
{
  *aResult = new nsXFormsInsertDeleteElement(PR_TRUE);
  if (!*aResult)
    return NS_ERROR_OUT_OF_MEMORY;

  NS_ADDREF(*aResult);
  return NS_OK;
}


NS_HIDDEN_(nsresult)
NS_NewXFormsDeleteElement(nsIXTFElement **aResult)
{
  *aResult = new nsXFormsInsertDeleteElement(PR_FALSE);
  if (!*aResult)
    return NS_ERROR_OUT_OF_MEMORY;

  NS_ADDREF(*aResult);
  return NS_OK;
}
