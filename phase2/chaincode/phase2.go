package chaincode

import (
  "encoding/json"
  "fmt"
  "log"
  "encoding/base64"
  "github.com/hyperledger/fabric-contract-api-go/contractapi"
  "time"
  "strings"
  "github.com/golang/protobuf/ptypes"


  
)



// SmartContract provides functions for managing an Asset
type SmartContract struct {
  contractapi.Contract
}

// Asset describes basic details of what makes up a simple asset
type Asset struct {
  ID             string `json:"ID"`
  Color          string `json:"color"`
  Size           int    `json:"size"`
  Owner          string `json:"owner"`
  AppraisedValue int    `json:"appraisedValue"`
  Timestamp time.Time `json:"timestamp"`
  Creator string `json:creator`
  TransferedTo string `json:transferedTo`
  
}



// InitLedger adds a base set of assets to the ledger
func (s *SmartContract) InitLedger(ctx contractapi.TransactionContextInterface) error {
	timeS,err:= ctx.GetStub().GetTxTimestamp()
	if err != nil {
		return  err
	}
	timestamp, err := ptypes.Timestamp(timeS)
	if err != nil {
		return err
	}
	clientID, err := s.GetSubmittingClientIdentity(ctx)
	if err != nil {
		return err
	}
	creatorDN, err:=s.GetSubmittingClientDN(ctx)
	if err != nil {
		return err
	}

  assets := []Asset{
    {ID: "asset1", Color: "blue", 	Size: 5,  Owner: clientID, AppraisedValue: 300,Timestamp: timestamp,Creator: creatorDN,TransferedTo:""},
    {ID: "asset2", Color: "red", 	Size: 5,  Owner: clientID, AppraisedValue: 400,Timestamp: timestamp,Creator: creatorDN,TransferedTo:""},
    {ID: "asset3", Color: "green", 	Size: 10, Owner: clientID, AppraisedValue: 500,Timestamp: timestamp,Creator: creatorDN,TransferedTo:""},
    {ID: "asset4", Color: "yellow", Size: 10, Owner: clientID, AppraisedValue: 600,Timestamp: timestamp,Creator: creatorDN,TransferedTo:""},
    {ID: "asset5", Color: "black", 	Size: 15, Owner: clientID, AppraisedValue: 700,Timestamp: timestamp,Creator: creatorDN,TransferedTo:""},
    {ID: "asset6", Color: "white", 	Size: 15, Owner: clientID, AppraisedValue: 800,Timestamp: timestamp,Creator: creatorDN,TransferedTo:""},
  }

  for _, asset := range assets {
    assetJSON, err := json.Marshal(asset)
    if err != nil {
      return err
    }

    err = ctx.GetStub().PutState(asset.ID, assetJSON)
    if err != nil {
      return fmt.Errorf("failed to put to world state. %v", err)
    }
  }

  return nil
}

// CreateAsset issues a new asset to the world state with given details.
func (s *SmartContract) CreateAsset(ctx contractapi.TransactionContextInterface, id string, color string, size int, appraisedValue int) error {


	
	txTimestamp, error := ctx.GetStub().GetTxTimestamp()
	if error != nil {
		return  error
	}
	timestamp, erri := ptypes.Timestamp(txTimestamp)
	if erri != nil {
		return  erri
	}

	temp := ctx.GetClientIdentity().AssertAttributeValue("retailer", "true")
	if temp==nil {
		return fmt.Errorf("submitting client not authorized to create asset, he is a Retailer")
	}

	err := ctx.GetClientIdentity().AssertAttributeValue("farmer", "true")
	if err != nil {
		return fmt.Errorf("submitting client not authorized to create asset, he is not a Farmer")
	}

	exists, err := s.AssetExists(ctx, id)
	if err != nil {
		return err
	}
	if exists {
		return fmt.Errorf("the asset %s already exists", id)
	}

	// Get ID of submitting client identity

	clientID, err := s.GetSubmittingClientIdentity(ctx)
	if err != nil {
		return err
	}
	creatorDN, err:=s.GetSubmittingClientDN(ctx)
	if err != nil {
		return err
	}

	asset := Asset{
		ID:             id,
		Color:          color,
		Size:           size,
		Owner:          clientID,
		AppraisedValue: appraisedValue,
		Timestamp: timestamp,
		Creator:        creatorDN,
		TransferedTo: ""}
	assetJSON, err := json.Marshal(asset)
	if err != nil {
		return err
	}

	return ctx.GetStub().PutState(id, assetJSON)
}

// UpdateAsset updates an existing asset in the world state with provided parameters.
func (s *SmartContract) UpdateAsset(ctx contractapi.TransactionContextInterface, id string, newColor string, newSize int, newValue int) error {

	asset, err := s.ReadAsset(ctx, id)
	if err != nil {
		return err
	}

	clientID, err := s.GetSubmittingClientIdentity(ctx)
	if err != nil {
		return err
	}

	if clientID != asset.Owner {
		return fmt.Errorf("submitting client not authorized to update asset, does not own asset")
	}

	asset.Color = newColor
	asset.Size = newSize
	asset.AppraisedValue = newValue

	assetJSON, err := json.Marshal(asset)
	if err != nil {
		return err
	}

	return ctx.GetStub().PutState(id, assetJSON)
}

// DeleteAsset deletes a given asset from the world state.
func (s *SmartContract) DeleteAsset(ctx contractapi.TransactionContextInterface, id string) error {

	asset, err := s.ReadAsset(ctx, id)
	if err != nil {
		return err
	}

	clientID, err := s.GetSubmittingClientIdentity(ctx)
	if err != nil {
		return err
	}

	if clientID != asset.Owner {
		return fmt.Errorf("submitting client not authorized to update asset, does not own asset")
	}

	return ctx.GetStub().DelState(id)
}

// TransferAsset updates the owner field of asset with given id in world state.
func (s *SmartContract) TransferAsset(ctx contractapi.TransactionContextInterface, id string, newOwner string) error {

	asset, err := s.ReadAsset(ctx, id)
	if err != nil {
		return err
	}

	clientID, err := s.GetSubmittingClientIdentity(ctx)
	if err != nil {
		return err
	}

	if clientID != asset.Owner {
		return fmt.Errorf("submitting client not authorized to update asset, does not own asset")
	}
	asset.TransferedTo=clientID+" is transfering "+id+" to "+newOwner;
	asset.Owner = newOwner
	assetJSON, err := json.Marshal(asset)
	if err != nil {
		return err
	}

	return ctx.GetStub().PutState(id, assetJSON)
}





// AssetExists returns true when asset with given ID exists in world state
func (s *SmartContract) AssetExists(ctx contractapi.TransactionContextInterface, id string) (bool, error) {

	assetJSON, err := ctx.GetStub().GetState(id)
	if err != nil {
		return false, fmt.Errorf("failed to read from world state: %v", err)
	}

	return assetJSON != nil, nil
}

// GetSubmittingClientIdentity returns the name and issuer of the identity that
// invokes the smart contract. This function base64 decodes the identity string
// before returning the value to the client or smart contract.
//files is located at pkg/cid/cid.go for GetID() on sourcegraph.com
//returns x509::CN=FarmerO,OU=org1+OU=client+OU=department1::CN=ca.org1.example.com,O=org1.example.com,L=Durham,ST=North Carolina,C=US
//on GetId() => ("x509::%s::%s", getDN(&c.cert.Subject), getDN(&c.cert.Issuer)
//DN is distinguished name as defined by RFC 2253
/* https://sourcegraph.com/github.com/hyperledger/fabric-chaincode-go@38d29fabecb9916a8a1ecbd0facb72f2ac32d016/-/blob/pkg/cid/cid.go?L76 */
func (s *SmartContract) GetSubmittingClientIdentity(ctx contractapi.TransactionContextInterface) (string, error) {

	b64ID, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		return "", fmt.Errorf("Failed to read clientID: %v", err)
	}
	decodeID, err := base64.StdEncoding.DecodeString(b64ID)
	if err != nil {
		return "", fmt.Errorf("failed to base64 decode clientID: %v", err)
	}
	clientName:=_between(string(decodeID),"x509::CN=",",")
	return  clientName, nil
}
//GetSubmittingClientDN returns the Distinguished Name as defined by RFC 2253
func (s *SmartContract) GetSubmittingClientDN(ctx contractapi.TransactionContextInterface) (string, error) {

	b64ID, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		return "", fmt.Errorf("Failed to read clientID: %v", err)
	}
	decodeID, err := base64.StdEncoding.DecodeString(b64ID)
	if err != nil {
		return "", fmt.Errorf("failed to base64 decode clientID: %v", err)
	}
	
	return string(decodeID) , nil
}

//Function to get string between two strings.
func _between(value string, a string, b string) string {
    // Get substring between two strings.
    posFirst := strings.Index(value, a)
    if posFirst == -1 {
        return ""
    }
    posLast := strings.Index(value, b)
    if posLast == -1 {
        return ""
    }
    posFirstAdjusted := posFirst + len(a)
    if posFirstAdjusted >= posLast {
        return ""
    }
    return value[posFirstAdjusted:posLast]
}
func main() {
  assetChaincode, err := contractapi.NewChaincode(&SmartContract{})
  if err != nil {
    log.Panicf("Error creating asset-transfer-basic chaincode: %v", err)
  }

  if err := assetChaincode.Start(); err != nil {
    log.Panicf("Error starting asset-transfer-basic chaincode: %v", err)
  }
}
